import { Address } from '@components/common/Address';
import { BorshInstructionCoder, Idl, Instruction, Program } from '@coral-xyz/anchor';
import { IdlInstruction } from '@coral-xyz/anchor/dist/cjs/idl';
import { SignatureResult, TransactionInstruction } from '@solana/web3.js';
import {
    getAnchorAccountsFromInstruction,
    getAnchorNameForInstruction,
    getAnchorProgramName,
    mapIxArgsToRows,
} from '@utils/anchor';
import { camelToTitleCase } from '@utils/index';
import { useMemo } from 'react';

import { InstructionCard } from './InstructionCard';
import {useTransactionDetails} from "@providers/transactions/parsed";
import {signature} from "@solana/web3.js/src/layout";

export default function AnchorDetailsCard(props: {
    ix: TransactionInstruction;
    index: number;
    result: SignatureResult;
    signature: string;
    innerCards?: JSX.Element[];
    childIndex?: number;
    anchorProgram: Program<Idl>;
}) {
    const { ix, anchorProgram } = props;
    const programName = getAnchorProgramName(anchorProgram) ?? 'Unknown Program';

    const ixName = getAnchorNameForInstruction(ix, anchorProgram) ?? 'Unknown Instruction';
    const cardTitle = `${camelToTitleCase(programName)}: ${camelToTitleCase(ixName)}`;

    return (
        <InstructionCard title={cardTitle} {...props}>
            <AnchorDetails ix={ix} signature={props.signature} anchorProgram={anchorProgram}/>
        </InstructionCard>
    );
}

function AnchorDetails({ix, anchorProgram, signature}: {
    ix: TransactionInstruction;
    anchorProgram: Program,
    signature: string
}) {
    const details = useTransactionDetails(signature);

    const transactionWithMeta = details?.data?.transactionWithMeta;
    const accountSources: Record<string, string> = {};
    if (transactionWithMeta) {
        const {message} = transactionWithMeta.transaction;
        message.accountKeys.map((account) => {
            accountSources[account.pubkey.toBase58()] = account.source || 'Unknown Source';
        });
    }


    const { ixAccounts, decodedIxData, ixDef } = useMemo(() => {
        let ixAccounts:
            | {
                name: string;
                isMut: boolean;
                isSigner: boolean;
                pda?: object;
            }[]
            | null = null;
        let decodedIxData: Instruction | null = null;
        let ixDef: IdlInstruction | undefined;
        if (anchorProgram) {
            const coder = new BorshInstructionCoder(anchorProgram.idl);
            decodedIxData = coder.decode(ix.data);
            if (decodedIxData) {
                ixDef = anchorProgram.idl.instructions.find(ixDef => ixDef.name === decodedIxData?.name);
                if (ixDef) {
                    ixAccounts = getAnchorAccountsFromInstruction(decodedIxData, anchorProgram);
                }
            }
        }

        return {
            decodedIxData,
            ixAccounts,
            ixDef,
        };
    }, [anchorProgram, ix.data]);

    if (!ixAccounts || !decodedIxData || !ixDef) {
        return (
            <tr>
                <td colSpan={3} className="text-lg-center">
                    Failed to decode account data according to the public Anchor interface
                </td>
            </tr>
        );
    }

    const programName = getAnchorProgramName(anchorProgram) ?? 'Unknown Program';

    return (
        <>
            <tr>
                <td>Program</td>
                <td className="text-lg-end" colSpan={2}>
                    <Address pubkey={ix.programId} alignRight link raw overrideText={programName} />
                </td>
            </tr>
            <tr className="table-sep">
                <td>Account Name</td>
                <td className="text-lg-end" colSpan={2}>
                    Address
                </td>
            </tr>
            {ix.keys.map(({ pubkey, isSigner, isWritable }, keyIndex) => {
                return (
                    <tr key={keyIndex}>
                        <td>
                            <div className="me-2 d-md-inline">
                                {ixAccounts
                                    ? keyIndex < ixAccounts.length
                                        ? `${camelToTitleCase(ixAccounts[keyIndex].name)}`
                                        : `Remaining Account #${keyIndex + 1 - ixAccounts.length}`
                                    : `Account #${keyIndex + 1}`}
                            </div>
                            {isWritable && <span className="badge bg-info-soft me-1">Writable</span>}
                            {isSigner && <span className="badge bg-info-soft me-1">Signer</span>}
                            {accountSources[pubkey.toBase58()] == 'lookupTable' &&
                                <span className="badge bg-info-soft me-1">Lookup Table</span>}
                        </td>
                        <td className="text-lg-end" colSpan={2}>
                            <Address pubkey={pubkey} alignRight link />
                        </td>
                    </tr>
                );
            })}

            {decodedIxData && ixDef && ixDef.args.length > 0 && (
                <>
                    <tr className="table-sep">
                        <td>Argument Name</td>
                        <td>Type</td>
                        <td className="text-lg-end">Value</td>
                    </tr>
                    {mapIxArgsToRows(decodedIxData.data, ixDef, anchorProgram.idl)}
                </>
            )}
        </>
    );
}
